# D:\crisis\app\app\config.py
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str
    log_dir: Path = Path("D:/crisis/logs")
    log_level: str = "INFO"
    log_max_bytes: int = 500 * 1024 * 1024

    enable_usgs: bool = True
    enable_gdacs: bool = True
    enable_emsc: bool = True
    enable_eonet: bool = True
    enable_gdelt: bool = True
    enable_openmeteo: bool = True
    enable_cma: bool = True
    enable_cenc: bool = True
    enable_firms: bool = False
    firms_map_key: str = ""

    interval_usgs: int = 120
    interval_gdacs: int = 360
    interval_eonet: int = 900
    interval_gdelt: int = 900
    interval_openmeteo: int = 21600
    interval_cma: int = 300
    interval_cenc: int = 180
    interval_firms: int = 900

    alert_eq_global_mag: float = 6.0
    alert_eq_local_mag: float = 4.5
    alert_mute_minutes: int = 30
    alert_conflict_min_confidence: float = 0.7


settings = Settings()
