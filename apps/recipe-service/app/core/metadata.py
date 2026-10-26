"""Single metadata object for Alembic; importing it registers every module's tables."""

from sqlmodel import SQLModel

from app.auth import models as auth_models
from app.imports import models as imports_models
from app.photos import models as photos_models
from app.recipes import models as recipes_models
from app.tags import models as tags_models
from app.users import models as users_models

MODEL_MODULES = (
    auth_models,
    imports_models,
    photos_models,
    recipes_models,
    tags_models,
    users_models,
)

metadata = SQLModel.metadata
