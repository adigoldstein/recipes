"""`GET /api/tags` (Story 1.9). Written first: they fail until the endpoint exists."""

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.tags.models import Tag
from tests.factories import add_recipe, add_tag

DEFAULT_PINNED_NAMES = [
    "בוקר",
    "בראנץ'",
    "צהריים",
    "ערב",
    "נשנוש",
    "עיקרית",
    "תוספת",
    "מנה ראשונה/סלט",
    "מרק",
    "מאפה",
    "קינוח",
    "משקה",
    "רוטב/ממרח",
]


def list_tags(client: TestClient) -> list[dict[str, Any]]:
    response = client.get("/api/tags")
    assert response.status_code == 200
    tags: list[dict[str, Any]] = response.json()
    return tags


def test_lists_the_default_pinned_tags_in_display_order(client: TestClient) -> None:
    tags = list_tags(client)
    assert [tag["name"] for tag in tags] == DEFAULT_PINNED_NAMES
    assert all(tag["pinned"] is True for tag in tags)


def test_each_tag_has_exactly_id_name_and_pinned(
    client: TestClient, session: Session
) -> None:
    free = add_tag(session, "על האש")
    tags = list_tags(client)
    assert all(set(tag) == {"id", "name", "pinned"} for tag in tags)
    assert {"id": str(free.id), "name": "על האש", "pinned": False} in tags


def test_unpinned_tags_follow_the_pinned_ones_ordered_by_name(
    client: TestClient, session: Session
) -> None:
    add_tag(session, "תפוח")
    add_tag(session, "banana")
    add_tag(session, "Cherry")
    add_tag(session, "אפרסק")
    names = [tag["name"] for tag in list_tags(client)]
    # Case-insensitive, like the tags embedded in recipes (AD-20).
    assert names[len(DEFAULT_PINNED_NAMES) :] == ["banana", "Cherry", "אפרסק", "תפוח"]
    assert names[: len(DEFAULT_PINNED_NAMES)] == DEFAULT_PINNED_NAMES


def test_pinned_tags_are_ordered_by_sort_order_not_by_name(
    client: TestClient, session: Session
) -> None:
    session.add(Tag(name="אבטיח", pinned=True, sort_order=99))
    session.commit()
    names = [tag["name"] for tag in list_tags(client)]
    assert names[-1] == "אבטיח"
    assert names[:-1] == DEFAULT_PINNED_NAMES


def test_includes_tags_that_no_recipe_uses(
    client: TestClient, session: Session
) -> None:
    used = add_tag(session, "מסיבות")
    unused = add_tag(session, "פינגר פוד")
    add_recipe(session, tags=[used])
    names = {tag["name"] for tag in list_tags(client)}
    assert {used.name, unused.name} <= names


def test_is_public(client: TestClient) -> None:
    # No session cookie and no CSRF header: a visitor can read the tags.
    assert not client.cookies
    list_tags(client)


def test_operation_id_and_response_schema_are_published(app: FastAPI) -> None:
    spec: dict[str, Any] = app.openapi()
    operation = spec["paths"]["/api/tags"]["get"]
    assert operation["operationId"] == "tags_list_tags"

    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema["type"] == "array"
    assert schema["items"]["$ref"].endswith("/TagRead")

    tag_read = spec["components"]["schemas"]["TagRead"]
    assert set(tag_read["properties"]) == {"id", "name", "pinned"}
    assert set(tag_read["required"]) == {"id", "name", "pinned"}
