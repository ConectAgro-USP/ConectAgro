import httpx


def fake_client(response, **client_options) -> tuple[httpx.Client, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if isinstance(response, Exception):
            raise response
        return response

    # sem timeout no client, as asserções de timeout só passam se o connector definir o seu
    client = httpx.Client(transport=httpx.MockTransport(handler), timeout=None, **client_options)
    return client, requests
