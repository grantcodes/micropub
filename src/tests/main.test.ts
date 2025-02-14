import { it, describe, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { data as serverData } from "./_data/data.js";
import testImageName from "./_data/image.png";
import { MicropubError } from "../lib/micropub-error.js";
import { Micropub } from "../main.js";

/* eslint-disable @typescript-eslint/no-floating-promises */

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url));

const baseOptions = {
  clientId: "https://test.com",
  redirectUri: "https://test.com/redirect",
  me: "https://example.com",
  state: "state",
};

const fullOptions = {
  ...baseOptions,
  token: "token",
  tokenEndpoint: serverData.endpoints.token_endpoint,
  authEndpoint: serverData.endpoints.authorization_endpoint,
  micropubEndpoint: serverData.endpoints.micropub,
  mediaEndpoint: serverData.endpoints.media,
};

// let testServerInstance: null | Server = null

describe("Micropub", () => {
  afterEach(() => {
    mock.reset();
  });

  /**
   * Tests that a method will throw an error if the required options are not set
   */
  it("Basic required fields", async () => {
    const micropub = new Micropub();

    try {
      await micropub.getAuthUrl();
      throw new Error("Test failed, did not throw expected error");
    } catch (err: unknown) {
      assert.ok(err instanceof MicropubError);
      assert.equal(err.message, "Missing required options: me, state");
    }
  });

  it("Check required options function", () => {
    const micropub = new Micropub();
    micropub.options = { foo: "bar" };

    try {
      micropub.checkRequiredOptions(["bar"]);
    } catch (err: unknown) {
      assert.ok(err instanceof MicropubError);
      assert.equal(err.error, null);
      assert.equal(err.message, "Missing required options: bar");
      assert.equal(err.status, null);
    }

    assert.ok(micropub.checkRequiredOptions(["foo"]));
  });

  it("Get endpoints from url html", async () => {
    mock.method(global, "fetch", () => {
      return {
        status: 200,
        text: () => serverData.pageHtml,
        headers: new Headers({ "Content-Type": "text/html" }),
      };
    });

    const micropub = new Micropub(baseOptions);
    const endpoints = await micropub.getEndpointsFromUrl(baseOptions.me);
    assert.equal(endpoints.auth, fullOptions.authEndpoint);
    assert.equal(endpoints.token, fullOptions.tokenEndpoint);
    assert.equal(endpoints.micropub, fullOptions.micropubEndpoint);
  });

  it("Get endpoints from url headers", async () => {
    mock.method(global, "fetch", () => {
      return {
        status: 200,
        text: () => "",
        headers: new Headers({
          Link: `<${fullOptions.authEndpoint}>; rel="authorization_endpoint", <${fullOptions.tokenEndpoint}>; rel="token_endpoint", <${fullOptions.micropubEndpoint}>; rel="micropub"`,
        }),
      };
    });

    const micropub = new Micropub(baseOptions);
    const endpoints = await micropub.getEndpointsFromUrl(baseOptions.me);
    assert.equal(endpoints.auth, fullOptions.authEndpoint);
    assert.equal(endpoints.token, fullOptions.tokenEndpoint);
    assert.equal(endpoints.micropub, fullOptions.micropubEndpoint);
  });

  // TODO: Test returning non json and test returning invalid response.
  it("Get token", async () => {
    mock.method(global, "fetch", () => {
      return {
        status: 200,
        json: () => ({
          access_token: serverData.token,
          me: baseOptions.me,
          scope: "create delete update",
        }),
      };
    });

    const micropub = new Micropub(fullOptions);
    const token = await micropub.getToken("code");
    assert.equal(token, serverData.token);
  });

  it("Get auth endpoint", async () => {
    mock.method(global, "fetch", () => {
      return {
        status: 200,
        text: () => serverData.pageHtml,
        headers: new Headers({ "Content-Type": "text/html" }),
      };
    });
    const micropub = new Micropub(baseOptions);
    const authUrlRes = await micropub.getAuthUrl();
    const parsedUrl = new URL(authUrlRes);

    assert.equal(parsedUrl.host, "localhost:3313");
    assert.equal(parsedUrl.pathname, "/auth");
    assert.equal(parsedUrl.searchParams.get("me"), baseOptions.me);
    assert.equal(parsedUrl.searchParams.get("client_id"), baseOptions.clientId);
    assert.equal(
      parsedUrl.searchParams.get("redirect_uri"),
      baseOptions.redirectUri,
    );
    assert.equal(parsedUrl.searchParams.get("state"), baseOptions.state);
    assert.equal(parsedUrl.searchParams.get("response_type"), "code");
    assert.equal(parsedUrl.searchParams.get("scope"), "create delete update");
  });

  it("Verify token", async () => {
    mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({}),
      text: () => "",
      ok: true,
    }));
    const micropub = new Micropub(fullOptions);
    const valid = await micropub.verifyToken();
    assert.ok(valid);
    mock.reset();

    mock.method(global, "fetch", () => ({
      status: 401,
      headers: new Headers({}),
      text: () => "",
      ok: false,
    }));
    micropub.options = { token: "invalid" };
    try {
      await micropub.verifyToken();
      throw new Error("Test failed, did not throw expected error");
    } catch (err: unknown) {
      assert.ok(err instanceof MicropubError);
      assert.equal(err.message, "Token verification failed");
      assert.equal(err.status, 401);
    }
  });

  it("Create note json encoded", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        Location: serverData.mf2.note.properties.url[0],
      }),
      text: () => "",
      json: () => serverData.mf2.note,
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const noteUrl = await micropub.create(serverData.mf2.note);
    assert.equal(noteUrl, serverData.mf2.note.properties.url[0]);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], fullOptions.micropubEndpoint);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "POST");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("content-type"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
    assert.equal(fetchArgs[1].body, JSON.stringify(serverData.mf2.note));
  });

  it("Create note form encoded", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        Location: serverData.mf2.note.properties.url[0],
      }),
      text: () => "",
      json: () => serverData.mf2.note,
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const noteUrl = await micropub.create(
      {
        h: "entry",
        content: serverData.mf2.note.properties.content[0],
      },
      "form",
    );
    assert.equal(noteUrl, serverData.mf2.note.properties.url[0]);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], fullOptions.micropubEndpoint);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "POST");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(
      fetchHeaders.get("content-type"),
      "application/x-www-form-urlencoded;charset=UTF-8",
    );
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
    assert.equal(
      fetchArgs[1].body,
      `h=entry&content=${encodeURIComponent(serverData.mf2.note.properties.content[0])}`,
    );
  });

  it("Update note", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        Location: serverData.mf2.note.properties.url[0],
      }),
      text: () => "",
      json: () => serverData.mf2.note,
      ok: true,
    }));
    const micropub = new Micropub(fullOptions);
    const res = await micropub.update(serverData.mf2.note.properties.url[0], {
      replace: { content: ["Replaced content"] },
    });
    assert.ok(res);
    assert.equal(res, serverData.mf2.note.properties.url[0]);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], fullOptions.micropubEndpoint);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "POST");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("content-type"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
    assert.deepStrictEqual(JSON.parse(fetchArgs[1].body as string), {
      replace: { content: ["Replaced content"] },
      action: "update",
      url: serverData.mf2.note.properties.url[0],
    });
  });

  it("Delete note", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        Location: serverData.mf2.note.properties.url[0],
      }),
      text: () => "",
      json: () => serverData.mf2.note,
      ok: true,
    }));
    const micropub = new Micropub(fullOptions);
    const res = await micropub.delete(serverData.mf2.note.properties.url[0]);
    assert.ok(res);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], fullOptions.micropubEndpoint);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "POST");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("content-type"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
    assert.deepStrictEqual(JSON.parse(fetchArgs[1].body as string), {
      action: "delete",
      url: serverData.mf2.note.properties.url[0],
    });
  });

  it("Undelete note", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 201,
      headers: new Headers({
        Location: serverData.mf2.note.properties.url[0],
      }),
      text: () => "",
      json: () => serverData.mf2.note,
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const noteUrl = serverData.mf2.note.properties.url[0];
    const undeleteUrl = await micropub.undelete(noteUrl);
    assert.equal(undeleteUrl, noteUrl);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], fullOptions.micropubEndpoint);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "POST");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("content-type"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
    assert.deepStrictEqual(JSON.parse(fetchArgs[1].body as string), {
      action: "undelete",
      url: serverData.mf2.note.properties.url[0],
    });
  });

  it("Post media", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 201,
      headers: new Headers({
        Location: serverData.fileUrl,
      }),
      text: () => "",
      json: () => "",
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const filePath = join(__dirname, "..", testImageName);
    const buffer = readFileSync(filePath);
    const url = await micropub.postMedia(new Blob([buffer]));
    assert.equal(url, serverData.fileUrl);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], fullOptions.mediaEndpoint);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "POST");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
    // Make sure body is FormData and content-type header not set
    assert.ok(fetchArgs[1].body instanceof FormData);
    assert.equal(fetchHeaders.get("content-type"), null);
  });

  it("Query config", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => serverData.micropubConfig,
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const config = await micropub.query("config");
    assert.deepEqual(config, serverData.micropubConfig);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], `${fullOptions.micropubEndpoint}?q=config`);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });

  it("Query syndication targets", async () => {
    const syndicateTo = {
      "syndicate-to": serverData.micropubConfig["syndicate-to"],
    };
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => syndicateTo,
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const result = await micropub.query("syndicate-to");
    assert.deepEqual(result, syndicateTo);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(
      fetchArgs[0],
      `${fullOptions.micropubEndpoint}?q=syndicate-to`,
    );
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });

  it("Query handles error", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 400,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => ({
        error: "invalid_request",
        error_description: "Unsupported query",
      }),
      ok: false,
    }));

    const micropub = new Micropub(fullOptions);
    try {
      await micropub.query("throw-error");
      throw new Error("Test failed, did not throw expected error");
    } catch (err: unknown) {
      assert.ok(err instanceof MicropubError);
      assert.equal(err.message, "Error getting throw-error");
      assert.equal(err.status, 400);
    }

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], `${fullOptions.micropubEndpoint}?q=throw-error`);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });

  it("Query category list", async () => {
    const categories = { categories: serverData.micropubConfig.categories };
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => categories,
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const targets = await micropub.query("category");
    assert.deepEqual(targets, categories);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], `${fullOptions.micropubEndpoint}?q=category`);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });

  it("Query source", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => serverData.mf2.note,
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const post = await micropub.querySource(
      serverData.mf2.note.properties.url[0],
    );
    assert.deepEqual(post, serverData.mf2.note);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(
      fetchArgs[0],
      `${fullOptions.micropubEndpoint}?q=source&url=${encodeURIComponent(serverData.mf2.note.properties.url[0])}`,
    );
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });

  it("Query source content property", async () => {
    const contentResponse = {
      properties: {
        content: serverData.mf2.note.properties.content,
      },
    };
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => contentResponse,
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const res = await micropub.querySource(
      serverData.mf2.note.properties.url[0],
      ["content"],
    );
    assert.deepEqual(res, contentResponse);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(
      fetchArgs[0],
      `${fullOptions.micropubEndpoint}?q=source&url=${encodeURIComponent(serverData.mf2.note.properties.url[0])}&properties[]=content`,
    );
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });

  it("Query source list", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => ({ items: serverData.mf2.list }),
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const { items } = await micropub.querySource();
    assert.deepEqual(items, serverData.mf2.list);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(fetchArgs[0], `${fullOptions.micropubEndpoint}?q=source`);
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });

  it("Custom query source", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => ({ items: [serverData.mf2.note] }),
      ok: true,
    }));

    const micropub = new Micropub(fullOptions);
    const { items } = await micropub.querySource({ "post-type": "note" });
    assert.deepEqual(items, [serverData.mf2.note]);

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(
      fetchArgs[0],
      `${fullOptions.micropubEndpoint}?q=source&post-type=note`,
    );
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });

  it("Query source returns error", async () => {
    const fetchMock = mock.method(global, "fetch", () => ({
      status: 400,
      headers: new Headers({
        "content-type": "application/json",
      }),
      text: () => "",
      json: () => ({
        error: "invalid_request",
        error_description: "The post with the requested URL was not found",
      }),
      ok: false,
    }));

    const micropub = new Micropub(fullOptions);
    try {
      await micropub.querySource("doesnt-exist");
      throw new Error("Test failed, did not throw expected error");
    } catch (err: unknown) {
      assert.ok(err instanceof MicropubError);
      assert.equal(err.message, "Error getting source");
      assert.equal(err.status, 400);
    }

    const fetchArgs = fetchMock.mock.calls[0].arguments;
    if (fetchArgs[1] === undefined) {
      throw new Error("Fetch args not set");
    }
    assert.equal(
      fetchArgs[0],
      `${fullOptions.micropubEndpoint}?q=source&url=doesnt-exist`,
    );
    assert.equal(fetchArgs.length, 2);
    assert.equal(fetchArgs[1].method, "GET");
    const fetchHeaders = fetchArgs[1].headers as Headers;
    if (fetchArgs[1].headers === undefined) {
      throw new Error("Headers not set");
    }
    assert.equal(fetchHeaders.get("accept"), "application/json");
    assert.equal(
      fetchHeaders.get("authorization"),
      `Bearer ${fullOptions.token}`,
    );
  });
});
