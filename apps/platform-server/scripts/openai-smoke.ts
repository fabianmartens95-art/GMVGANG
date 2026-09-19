const apiKey = process.env.OPENAI_API_KEY?.trim();

if (!apiKey) {
  console.error(JSON.stringify({
    openaiSmoke: false,
    reason: "OPENAI_API_KEY_missing",
  }));
  process.exit(1);
}

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-5.6-luna",
    input: "Reply with exactly: OK",
    max_output_tokens: 8,
  }),
});

let payload;
try {
  payload = await response.json();
} catch {
  payload = null;
}

if (!response.ok) {
  const error = payload && typeof payload === "object" && "error" in payload
    ? payload.error
    : null;
  console.error(JSON.stringify({
    openaiSmoke: false,
    status: response.status,
    errorType: error && typeof error === "object" && "type" in error ? error.type : null,
    errorCode: error && typeof error === "object" && "code" in error ? error.code : null,
  }));
  process.exit(1);
}

console.log(JSON.stringify({
  openaiSmoke: true,
  status: response.status,
  responseIdPresent: Boolean(payload && typeof payload === "object" && "id" in payload && payload.id),
  model: payload && typeof payload === "object" && "model" in payload ? payload.model : "gpt-5.6-luna",
}));
