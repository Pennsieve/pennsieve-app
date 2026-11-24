// A JSON request as the app's useSendXhr makes it, for the notebook code's
// reads of Discover and the data portals: a JSON body, a rejected promise
// with the response at 400 and above, and the parsed body (or the response
// itself when it isn't JSON).
export function sendXhr(url, { method = "GET", header = {}, body } = {}) {
  if (!url) return Promise.reject({ status: 400, message: "Url is missing!" });
  const init = { method, headers: { "Content-type": "application/json", ...header } };
  if (body) init.body = JSON.stringify(body);
  return fetch(url, init).then((resp) => {
    if (resp.status >= 400) return Promise.reject(resp);
    return resp.json().catch(() => resp);
  });
}
