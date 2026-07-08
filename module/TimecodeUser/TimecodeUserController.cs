using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Shared;
using Shared.Models.Base;
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace TimecodeUser
{
    public class BatchTimecodeRequest
    {
        public List<TimecodeItem> timecodes { get; set; }
    }

    public class TimecodeItem
    {
        public string card_id { get; set; }
        public string item { get; set; }
        public string data { get; set; }
    }

    public class TimecodeUserController : BaseController
    {
        static readonly string _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = "database/TimeCode.sql",
            Cache = SqliteCacheMode.Shared,
            DefaultTimeout = 10,
            Pooling = true
        }.ToString();

        [Route("/timecode/all_views")]
        public async Task<ActionResult> GetUserTimecodes()
        {
            string userId = getUserid(requestInfo);

            if (string.IsNullOrEmpty(userId))
                return Json(new { });

            await using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT card, item, data FROM timecodes WHERE user = @user";
            cmd.Parameters.AddWithValue("@user", userId);

            var result = new Dictionary<string, Dictionary<string, string>>();

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var card = reader.GetString(0);
                var item = reader.GetString(1);
                var data = reader.GetString(2);

                if (!result.TryGetValue(card, out var items))
                {
                    items = new Dictionary<string, string>();
                    result[card] = items;
                }

                items[item] = data;
            }

            return Json(result);
        }

        [HttpPost]
        [Route("/timecode/batch_add")]
        public async Task<ActionResult> BatchAdd([FromBody] BatchTimecodeRequest request)
        {
            try
            {
                string userId = getUserid(requestInfo);

                if (string.IsNullOrEmpty(userId))
                    return Json(new { success = false, message = "User ID is required" });

                if (request?.timecodes == null || request.timecodes.Count == 0)
                    return Json(new { success = false, message = "No timecodes provided" });

                Console.WriteLine($"[TimecodeUser] Batch add started: {request.timecodes.Count} timecodes for user {userId}");

                await using var conn = new SqliteConnection(_connectionString);
                await conn.OpenAsync();

                // Load existing keys for this user
                var existingKeys = new HashSet<(string, string)>();
                using (var selectCmd = conn.CreateCommand())
                {
                    selectCmd.CommandText = "SELECT card, item FROM timecodes WHERE user = @user";
                    selectCmd.Parameters.AddWithValue("@user", userId);

                    await using var reader = await selectCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                        existingKeys.Add((reader.GetString(0), reader.GetString(1)));
                }

                Console.WriteLine($"[TimecodeUser] Found {existingKeys.Count} existing records");

                using var tx = conn.BeginTransaction();
                int added = 0;
                int updated = 0;

                foreach (var tc in request.timecodes)
                {
                    if (string.IsNullOrEmpty(tc.card_id) || string.IsNullOrEmpty(tc.item))
                        continue;

                    var key = (tc.card_id, tc.item);
                    bool isNew = existingKeys.Add(key); // Add returns false if key already existed

                    using var cmd = conn.CreateCommand();
                    cmd.Transaction = tx;
                    cmd.CommandText = @"
                        INSERT OR REPLACE INTO timecodes (user, card, item, data, updated)
                        VALUES (@user, @card, @item, @data, @updated)";
                    cmd.Parameters.AddWithValue("@user", userId);
                    cmd.Parameters.AddWithValue("@card", tc.card_id);
                    cmd.Parameters.AddWithValue("@item", tc.item);
                    cmd.Parameters.AddWithValue("@data", tc.data);
                    cmd.Parameters.AddWithValue("@updated", DateTime.UtcNow.ToString("o"));
                    cmd.ExecuteNonQuery();

                    if (isNew) added++; else updated++;
                }

                tx.Commit();

                Console.WriteLine($"[TimecodeUser] Batch add completed: {added} added, {updated} updated");

                return Json(new
                {
                    success = true,
                    added = added,
                    updated = updated,
                    total = request.timecodes.Count
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TimecodeUser] Batch add error: {ex.Message}");
                return Json(new { success = false, message = ex.Message });
            }
        }

        string getUserid(RequestModel requestInfo)
        {
            string user_id = requestInfo.user_uid;

            if (HttpContext.Request.Query.TryGetValue("profile_id", out var profile_id) && !string.IsNullOrEmpty(profile_id) && profile_id != "0")
                user_id = $"{user_id}_{profile_id}";

            return Regex.Replace(user_id, "[^a-z0-9\\-_\\.]+", "", RegexOptions.IgnoreCase);
        }
    }
}