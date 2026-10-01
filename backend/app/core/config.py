from datetime import timedelta

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "sqlite:///./swarm_debugger.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    max_debug_rounds: int = 5
    sandbox_timeout_seconds: int = 15
    sandbox_memory_mb: int = 512
    sandbox_cpu_limit: float = 1.0
    sandbox_pids_limit: int = 64
    sandbox_output_limit_bytes: int = 65536
    sandbox_backend: str = "auto"
    sandbox_image: str = "swarm-debugger-sandbox:mvp"
    sandbox_strict: bool = False
    trace_enabled: bool = True
    falsification_enabled: bool = True
    causal_enabled: bool = True
    max_sandbox_failures: int = 3
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    demo_email: str = "demo@swarm.local"
    demo_username: str = "demo"
    demo_password: str = "demo"
    session_cookie_name: str = "swarm_session"
    session_ttl_hours: int = 12

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def session_ttl(self) -> timedelta:
        return timedelta(hours=self.session_ttl_hours)

    @property
    def cookie_secure(self) -> bool:
        return self.app_env == "production"


settings = Settings()
