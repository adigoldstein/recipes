from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_old_health_route_is_gone(client: TestClient) -> None:
    assert client.get("/health").status_code == 404
