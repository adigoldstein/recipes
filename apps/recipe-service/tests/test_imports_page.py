"""Reading a fetched page: JSON-LD first, readable text second, challenges refused."""

import pytest

from app.core.safe_fetch import (
    FetchBlockedError,
    FetchChallengedError,
    FetchFailedError,
)
from app.imports.fetchers.base import FetchedPage
from app.imports.fetchers.fake import PAGES_DIR
from app.imports.page import read_page, recipe_text

URL = "https://example.com/recipes/cookies"


def fixture(
    name: str, status: int = 200, content_type: str = "text/html"
) -> FetchedPage:
    html = (PAGES_DIR / f"{name}.html").read_bytes()
    return FetchedPage(url=URL, status=status, content_type=content_type, html=html)


def html_page(body: str, status: int = 200) -> FetchedPage:
    return FetchedPage(URL, status, "text/html", body.encode())


# --- JSON-LD ---------------------------------------------------------------------


def test_a_json_ld_recipe_in_a_graph_is_used_first() -> None:
    page = read_page(fixture("json-ld-recipe"))
    assert page.path == "json_ld"
    assert page.text.startswith("Title: Chocolate Chip Cookies")
    assert "Description: Soft cookies with chocolate & a pinch of salt." in page.text
    assert "Servings: 24" in page.text
    assert "Prep time: PT15M" in page.text
    assert "- 2 cups flour\n- 200 g butter\n- 2 eggs\n- Salt" in page.text
    assert (
        "1. Dough:\n2. Cream the butter with the sugar.\n"
        "3. Add the flour and the chocolate.\n4. Bake for 12 minutes."
    ) in page.text
    # The page's story and menu are not sent.
    assert "long story" not in page.text


def test_the_recipe_image_wins_over_og_image() -> None:
    assert read_page(fixture("json-ld-recipe")).photo_url == (
        "https://example.com/cookies.jpg"
    )


@pytest.mark.parametrize(
    ("image", "expected"),
    [
        ('"/img/a.jpg"', "https://example.com/img/a.jpg"),
        ('["https://cdn.example.com/b.jpg", "x.jpg"]', "https://cdn.example.com/b.jpg"),
        (
            '{"@type": "ImageObject", "contentUrl": "c.jpg"}',
            "https://example.com/recipes/c.jpg",
        ),
        ('"data:image/png;base64,AAAA"', None),
        ('""', None),
    ],
)
def test_image_shapes(image: str, expected: str | None) -> None:
    body = (
        '<script type="application/ld+json">{"@type": "Recipe", "name": "x",'
        f' "image": {image}, "recipeIngredient": ["salt"]}}</script>'
    )
    assert read_page(html_page(body)).photo_url == expected


def test_a_recipe_without_ingredients_or_steps_falls_back_to_the_text() -> None:
    body = (
        '<html><head><script type="application/ld+json">{"@type": "Recipe",'
        ' "name": "Empty"}</script></head><body><main>2 eggs. Fry.</main></body></html>'
    )
    page = read_page(html_page(body))
    assert page.path == "llm"
    assert "2 eggs. Fry." in page.text


def test_broken_json_ld_is_skipped() -> None:
    body = (
        '<script type="application/ld+json">{not json</script>'
        '<script type="application/ld+json">[{"@type": "Recipe", "name": "B",'
        ' "recipeInstructions": "Mix.\\nBake."}]</script>'
    )
    page = read_page(html_page(body))
    assert page.path == "json_ld"
    assert "1. Mix.\n2. Bake." in page.text


def test_recipe_text_handles_a_main_entity_and_full_type_urls() -> None:
    assert recipe_text({"@type": "Recipe", "name": "Only a name"}) == ""
    text = recipe_text(
        {
            "@type": "http://schema.org/Recipe",
            "recipeYield": 4,
            "recipeIngredient": "<b>1 cup</b> rice",
        }
    )
    assert text == "Servings: 4\n\nIngredients:\n- 1 cup rice"


# --- Readable text ---------------------------------------------------------------


def test_without_json_ld_the_readable_text_and_og_image_are_used() -> None:
    page = read_page(fixture("no-json-ld"))
    assert page.path == "llm"
    assert "6 ביצים" in page.text
    assert "מוסיפים עגבניות וביצים." in page.text
    for noise in ("הבלוג של דנה", "מתכונים נוספים", "כל הזכויות", "tracking"):
        assert noise not in page.text
    # A relative og:image resolves against the page.
    assert page.photo_url == "https://example.com/images/shakshuka.jpg"


def test_an_empty_page_has_no_text() -> None:
    page = read_page(fixture("empty"))
    assert (page.text, page.photo_url) == ("", None)


# --- Challenges and refusals -----------------------------------------------------


def test_a_saved_cloudflare_challenge_is_fetch_challenged() -> None:
    with pytest.raises(FetchChallengedError):
        read_page(fixture("cloudflare-challenge", status=403))


def test_a_challenge_marker_counts_even_on_a_200() -> None:
    with pytest.raises(FetchChallengedError):
        read_page(fixture("cloudflare-challenge", status=200))


def test_a_challenge_title_on_a_503_is_fetch_challenged() -> None:
    with pytest.raises(FetchChallengedError):
        read_page(html_page("<title>Attention Required!</title>", status=503))


def test_a_plain_403_is_fetch_blocked() -> None:
    with pytest.raises(FetchBlockedError):
        read_page(fixture("forbidden", status=403))


@pytest.mark.parametrize("status", [404, 500, 302])
def test_other_statuses_are_fetch_failed(status: int) -> None:
    with pytest.raises(FetchFailedError):
        read_page(fixture("server-error", status=status))


def test_a_link_that_is_not_a_web_page_is_fetch_failed() -> None:
    with pytest.raises(FetchFailedError):
        read_page(fixture("json-ld-recipe", content_type="application/pdf"))
