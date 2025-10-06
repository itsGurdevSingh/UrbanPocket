// this middleware is use for debuging it logs dataa recived tohoug requestt the app
// eslint-disable-next-line no-unused-vars
export const reqLog = (req, res, next) => {
    console.log(`[Request] ${req.method} ${req.originalUrl} - Body:`, req.body, ' - Files:', req.files);
    // return res.send('check log for debugging ');
    next();
}

// middleware/parseJsonFields.js
export const parseJsonFields = (req, res, next) => {
  const fieldsToParse = ["attributes", "baseImages"];

  fieldsToParse.forEach((field) => {
    if (req.body[field]) {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (err) {
        // ignore if not JSON
      }
    }
  });

  next();
};
