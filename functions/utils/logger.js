export const log = {
  info: (msg, data) =>
    console.log(JSON.stringify({ level: "info", msg, ...data })),
  error: (msg, error, data) =>
    console.error(
      JSON.stringify({
        level: "error",
        msg,
        error: error.message,
        stack: error.stack,
        ...data,
      })
    ),
};