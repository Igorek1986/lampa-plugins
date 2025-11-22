using Microsoft.AspNetCore.Mvc;      
using Microsoft.EntityFrameworkCore;      
using Shared;      
using Shared.Engine;      
using Shared.Models;      
using Shared.Models.SQL;      
using System;    
using System.Collections.Generic;      
using System.Linq;  
using System.Threading.Tasks;  
using Newtonsoft.Json;    
using Newtonsoft.Json.Linq;    
      
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
        [Route("/timecode/all_views")]    
        public ActionResult GetUserTimecodes()      
        {      
            string userId = getUserid(requestInfo, HttpContext);      
                  
            if (string.IsNullOrEmpty(userId))      
                return Json(new { });      
            
            using (var sqlDb = new SyncUserContext())
            {
                var timecodes = sqlDb.timecodes
                    .AsNoTracking()
                    .Where(i => i.user == userId)
                    .Select(i => new { i.card, i.item, i.data })
                    .ToList();

                if (timecodes.Count == 0)      
                    return Json(new { });      
      
                var result = new Dictionary<string, Dictionary<string, string>>();      
                foreach (var tc in timecodes)      
                {      
                    if (!result.ContainsKey(tc.card))      
                        result[tc.card] = new Dictionary<string, string>();      
                          
                    result[tc.card][tc.item] = tc.data;      
                }      
      
                return Json(result);      
            }
        }      
    
        [HttpPost]  
        [Route("/timecode/batch_add")]  
        public async Task<ActionResult> BatchAdd([FromBody] BatchTimecodeRequest request)  
        {  
            try  
            {  
                string userId = getUserid(requestInfo, HttpContext);  
                
                if (string.IsNullOrEmpty(userId))  
                    return Json(new { success = false, message = "User ID is required" });  
        
                if (request?.timecodes == null || request.timecodes.Count == 0)  
                    return Json(new { success = false, message = "No timecodes provided" });  
        
                Console.WriteLine($"[TimecodeUser] Batch add started: {request.timecodes.Count} timecodes for user {userId}");  
        
                using (var sqlDb = new SyncUserContext())
                {
                    int batchSize = 100;  
                    int totalBatches = (int)Math.Ceiling(request.timecodes.Count / (double)batchSize);  
                    int added = 0;  
                    int updated = 0;  
            
                    // ✅ Загружаем существующие записи пользователя  
                    var existingDict = await sqlDb.timecodes  
                        .Where(t => t.user == userId)  
                        .ToDictionaryAsync(t => (t.card, t.item));  
            
                    Console.WriteLine($"[TimecodeUser] Found {existingDict.Count} existing records");  
            
                    for (int i = 0; i < request.timecodes.Count; i += batchSize)  
                    {  
                        int currentBatch = (i / batchSize) + 1;  
                        var batch = request.timecodes.Skip(i).Take(batchSize).ToList();  
            
                        Console.WriteLine($"[TimecodeUser] Processing batch {currentBatch}/{totalBatches} ({batch.Count} items)");  
            
                        foreach (var tc in batch)  
                        {  
                            if (string.IsNullOrEmpty(tc.card_id) || string.IsNullOrEmpty(tc.item))  
                                continue;  
            
                            var key = (tc.card_id, tc.item);  
            
                            // ✅ Проверяем в словаре  
                            if (existingDict.TryGetValue(key, out var existingRecord))  
                            {  
                                // Обновляем существующую запись  
                                existingRecord.data = tc.data;  
                                existingRecord.updated = DateTime.UtcNow;  
                                updated++;  
                            }  
                            else  
                            {  
                                // Добавляем новую запись  
                                var newRecord = new SyncUserTimecodeSqlModel  
                                {  
                                    user = userId,  
                                    card = tc.card_id,  
                                    item = tc.item,  
                                    data = tc.data,  
                                    updated = DateTime.UtcNow  
                                };  
                                
                                sqlDb.timecodes.Add(newRecord);  
                                
                                // ✅ ВАЖНО: Добавляем в словарь, чтобы избежать дубликатов в следующих пакетах  
                                existingDict[key] = newRecord;  
                                added++;  
                            }  
                        }  
            
                        try  
                        {  
                            int saved = await sqlDb.SaveChangesAsync();  
                            Console.WriteLine($"[TimecodeUser] Batch {currentBatch} saved: {saved} changes");  
                            
                            // Очищаем ChangeTracker для освобождения памяти  
                            sqlDb.ChangeTracker.Clear();  
                            
                            // ✅ Небольшая пауза между пакетами (50ms)  
                            await Task.Delay(50);  
                        }  
                        catch (Exception ex)  
                        {  
                            Console.WriteLine($"[TimecodeUser] Batch {currentBatch} error: {ex.Message}");  
                            if (ex.InnerException != null)  
                                Console.WriteLine($"[TimecodeUser] Inner exception: {ex.InnerException.Message}");  
                            
                            return Json(new   
                            {   
                                success = false,   
                                message = ex.Message,  
                                innerMessage = ex.InnerException?.Message,  
                                batch = currentBatch,  
                                totalBatches = totalBatches  
                            });  
                        }  
                    }  
            
                    Console.WriteLine($"[TimecodeUser] Batch add completed: {added} added, {updated} updated");  
            
                    return Json(new   
                    {   
                        success = true,   
                        added = added,   
                        updated = updated,  
                        total = request.timecodes.Count  
                    });  
                }
            }  
            catch (Exception ex)  
            {  
                Console.WriteLine($"[TimecodeUser] Batch add error: {ex.Message}");  
                return Json(new { success = false, message = ex.Message });  
            }  
        }
      
        static string getUserid(RequestModel requestInfo, Microsoft.AspNetCore.Http.HttpContext httpContext)      
        {      
            string user_id = requestInfo.user_uid;      
      
            if (httpContext.Request.Query.TryGetValue("profile_id", out var profile_id) && !string.IsNullOrEmpty(profile_id) && profile_id != "0")      
                return $"{user_id}_{profile_id}";      
      
            return user_id;      
        }      
    }      
}