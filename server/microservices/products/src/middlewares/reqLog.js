// this middleware is use for debuging it logs dataa recived tohoug requestt the app
// eslint-disable-next-line no-unused-vars
export const reqLog = (req, res, next) => {
  console.log(`[Request] ${req.method} ${req.originalUrl} - Body:`, req.body, ' - Files:', req.files);
  // return res.send('check log for debugging ');
  next();
}

// middleware/parseJsonFields.js
export const parseJsonFields = (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }
    const fieldsToParse = ["attributes", "baseImages"];
    fieldsToParse.forEach((field) => {
      const raw = req.body[field];
      if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        try {
          req.body[field] = JSON.parse(raw);
        } catch (_) { /* silent */ }
      }
    });
    return next();
  } catch (err) {
    // Fail-safe: do not block request because of parser error
    return next();
  }
};
