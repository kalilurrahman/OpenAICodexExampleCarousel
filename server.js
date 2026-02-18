const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const toneMap = {
  professional: ["strategic", "results-driven", "clear", "credible"],
  friendly: ["warm", "approachable", "encouraging", "conversational"],
  bold: ["confident", "high-energy", "direct", "provocative"],
  educational: ["informative", "structured", "insightful", "practical"]
};

const imageStyles = new Set(["photo", "illustration", "abstract"]);
const tones = new Set(Object.keys(toneMap));
const jobs = new Map();

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!data) return resolve({});
      try {
        return resolve(JSON.parse(data));
      } catch (_error) {
        return reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function sanitizeGenerationInput(payload) {
  const topic = String(payload.topic || "").trim();
  const tone = tones.has(payload.tone) ? payload.tone : "professional";
  const imageStyle = imageStyles.has(payload.imageStyle) ? payload.imageStyle : "illustration";
  const count = Math.max(1, Math.min(12, Number(payload.count) || 5));

  if (topic.length < 3) {
    throw new Error("Topic must be at least 3 characters.");
  }

  return { topic, tone, imageStyle, count };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateSlideText({ topic, tone, index, total }) {
  const anglePool = toneMap[tone] || toneMap.professional;
  const angle = anglePool[index % anglePool.length];
  await delay(350 + Math.floor(Math.random() * 250));

  return {
    headline: `${topic}: ${angle} insight ${index + 1}`,
    body:
      `Frame ${index + 1}/${total} gives a ${angle} perspective on ${topic}. ` +
      "Use this slide to communicate a practical takeaway and momentum.",
    cta: index + 1 === total ? "Ready to launch? Start now." : "Keep swiping for the next idea."
  };
}

async function generateSlideImage({ topic, imageStyle, index }) {
  await delay(220 + Math.floor(Math.random() * 280));
  return {
    imagePrompt: `${imageStyle} ${topic} social carousel square composition ${index + 1}`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(`${topic}-${imageStyle}-${index + 1}`)}/1024/1024`
  };
}

async function createSlidesForJob(job) {
  const { topic, tone, imageStyle, count } = job.input;
  job.status = "running";
  job.progress = 5;

  const slides = [];
  for (let index = 0; index < count; index += 1) {
    const [text, image] = await Promise.all([
      generateSlideText({ topic, tone, index, total: count }),
      generateSlideImage({ topic, imageStyle, index })
    ]);

    slides.push({
      id: `slide-${job.id}-${index + 1}`,
      ...text,
      ...image
    });

    job.progress = Math.round(((index + 1) / count) * 90) + 5;
  }

  job.progress = 100;
  job.status = "completed";
  job.result = {
    meta: {
      topic,
      tone,
      imageStyle,
      generatedAt: new Date().toISOString(),
      author: "Vibe Coding App",
      version: "v2"
    },
    slides
  };
}

function createJob(input) {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const job = {
    id,
    status: "queued",
    progress: 0,
    input,
    result: null,
    error: null,
    createdAt: Date.now()
  };

  jobs.set(id, job);
  createSlidesForJob(job).catch((error) => {
    job.status = "failed";
    job.error = error.message || "Generation failed";
  });

  return job;
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function serveStatic(urlPath, res) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const cleanPath = path.normalize(requested).replace(/^\.\.(\/|\\|$)/, "");
  const filePath = path.join(PUBLIC_DIR, cleanPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        fs.readFile(path.join(PUBLIC_DIR, "index.html"), (indexErr, indexContent) => {
          if (indexErr) {
            res.writeHead(500);
            return res.end("Server error");
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          return res.end(indexContent);
        });
        return;
      }

      res.writeHead(500);
      return res.end("Server error");
    }

    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": filePath.endsWith(".html") ? "no-cache" : "public, max-age=3600"
    });
    return res.end(content);
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 30 * 60 * 1000) {
      jobs.delete(id);
    }
  }
}, 60 * 1000).unref();

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && parsedUrl.pathname === "/api/generate") {
    try {
      const payload = await readBody(req);
      const input = sanitizeGenerationInput(payload);
      const job = createJob(input);
      return json(res, 202, { jobId: job.id, status: job.status, progress: job.progress });
    } catch (error) {
      const statusCode = error.message === "Payload too large" ? 413 : 400;
      return json(res, statusCode, { error: error.message });
    }
  }

  if (req.method === "GET" && parsedUrl.pathname.startsWith("/api/jobs/")) {
    const jobId = parsedUrl.pathname.replace("/api/jobs/", "");
    const job = jobs.get(jobId);

    if (!job) {
      return json(res, 404, { error: "Job not found" });
    }

    return json(res, 200, {
      jobId,
      status: job.status,
      progress: job.progress,
      error: job.error,
      result: job.status === "completed" ? job.result : null
    });
  }

  return serveStatic(parsedUrl.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Carousel app listening on http://localhost:${PORT}`);
});
