from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    allowed_origins: str = "http://localhost:3000,https://strategy-website.vercel.app"

    class Config:
        env_file = ".env"


settings = Settings()
