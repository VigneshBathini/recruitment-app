export function startServer({ app, pool, port, processObject = process, shutdownTimeoutMs = 30_000, logger = console }) {
  const server = app.listen(port);
  let shutdownPromise;

  const shutdown = (signal) => {
    if (shutdownPromise) return shutdownPromise;
    logger.info(`Received ${signal}; shutting down`);
    shutdownPromise = new Promise((resolve) => {
      let forced = false;
      const timeout = setTimeout(() => {
        forced = true;
        server.closeAllConnections?.();
      }, shutdownTimeoutMs);
      timeout.unref?.();

      server.close(async () => {
        clearTimeout(timeout);
        try {
          await pool.end();
          if (!forced) logger.info("Server shutdown complete");
          resolve();
        } catch {
          logger.error("Server shutdown completed with a database pool close error");
          resolve();
        }
      });
    });
    return shutdownPromise;
  };

  processObject.once("SIGTERM", shutdown);
  processObject.once("SIGINT", shutdown);
  return { server, shutdown };
}
