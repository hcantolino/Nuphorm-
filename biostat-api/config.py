"""
Global settings loaded from environment variables.
Copy .env.example → .env and fill in real values.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # CDISC Library API – register at https://api.developer.library.cdisc.org
    cdisc_api_key: str = ""
    cdisc_library_base_url: str = "https://library.cdisc.org/api"

    # Default ADaM version used when not specified in request
    default_adam_version: str = "1.3"

    # Dataset-JSON version
    dataset_json_version: str = "1.0.0"

    # Originator tag embedded in Define-XML / Dataset-JSON
    originator: str = "NuPhorm Platform"

    # CORS – set to your frontend origin in production
    cors_origins: list[str] = ["*"]

    # Uvicorn
    host: str = "0.0.0.0"
    port: int = 8001


settings = Settings()
