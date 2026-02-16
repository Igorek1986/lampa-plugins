import httpx


from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware


#MyShows
MYSHOWS_AUTH_URL = "https://myshows.me/api/session"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/auth")
async def proxy_auth(request: Request):
    data = await request.json()
    login = data.get("login")
    password = data.get("password")

    if not login or not password:
        raise HTTPException(
            status_code=400, detail="Login and password are required"
        )

    # Выполняем запрос к MyShows API
    async with httpx.AsyncClient() as client:
        response = await client.post(
            MYSHOWS_AUTH_URL,
            json={"login": login, "password": password},
            headers={"Content-Type": "application/json"},
            timeout=10.0,
        )

        auth_data = response.json()
        token = auth_data.get("token")

        return {"token": token }


# Для локального запуска
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=38000,
    )