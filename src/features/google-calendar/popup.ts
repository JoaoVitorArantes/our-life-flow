export function waitForCalendarOAuth(
  popup: Window,
  expected: { attemptId: string; nonce: string },
) {
  return new Promise<string>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
      window.clearTimeout(timeout);
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        data?.connectorId !== "google_calendar" ||
        data?.attemptId !== expected.attemptId ||
        data?.nonce !== expected.nonce
      )
        return;
      if (
        data.type !== "appUserConnectorOAuthComplete" &&
        data.type !== "appUserConnectorOAuthFailed"
      )
        return;
      cleanup();
      popup.close();
      if (
        data.type === "appUserConnectorOAuthComplete" &&
        typeof data.code === "string" &&
        data.code
      )
        resolve(data.code);
      else
        reject(
          new Error(
            "Não foi possível autorizar o Calendar. Verifique o acesso offline e tente novamente.",
          ),
        );
    };
    const timeout = window.setTimeout(
      () => {
        cleanup();
        popup.close();
        reject(new Error("Autorização expirada. Tente novamente."));
      },
      10 * 60 * 1000,
    );
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Autorização cancelada."));
      }
    }, 500);
  });
}
