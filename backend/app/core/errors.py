from fastapi import HTTPException, status


def api_error(status_code: int, category: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error": category, "message": message})


def validation_error(message: str) -> HTTPException:
    return api_error(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", message)


def auth_error(message: str, *, status_code: int = status.HTTP_401_UNAUTHORIZED) -> HTTPException:
    return api_error(status_code, "AUTH_ERROR", message)


def not_found(message: str) -> HTTPException:
    return api_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", message)


def conflict(message: str) -> HTTPException:
    return api_error(status.HTTP_409_CONFLICT, "CONFLICT", message)


def agent_error(message: str) -> HTTPException:
    return api_error(status.HTTP_502_BAD_GATEWAY, "AGENT_ERROR", message)


def llm_provider_error(message: str) -> HTTPException:
    return api_error(status.HTTP_502_BAD_GATEWAY, "LLM_PROVIDER_ERROR", message)


def sandbox_http_error(message: str) -> HTTPException:
    return api_error(status.HTTP_502_BAD_GATEWAY, "SANDBOX_ERROR", message)


def internal_error(message: str) -> HTTPException:
    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", message)
