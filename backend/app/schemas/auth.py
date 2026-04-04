from pydantic import BaseModel, Field


class AuthorizeUrlResponse(BaseModel):
    authorize_url: str


class GitHubExchangeRequest(BaseModel):
    code: str = Field(..., min_length=1)
    state: str | None = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: str | None = None
    avatar_url: str | None = None
    github_id: str | None = None
    created_at: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class GitHubCallbackResponse(TokenResponse):
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)
