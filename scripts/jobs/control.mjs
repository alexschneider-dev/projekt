import {
  JOB_ERRORS,
  JOB_STOPPED_CODE,
} from "./errors/index.mjs";


export function createImportControl(database, userId) {
  const controller = new AbortController();
  let pending = null;

  async function check() {
    controller.signal.throwIfAborted();
    const state = await database.jobImportState.findUniqueOrThrow({
      where: { userId },
      select: { stopRequested: true },
    });
    if (state.stopRequested) {
      controller.abort(Object.assign(new Error(JOB_ERRORS.stopped), { code: JOB_STOPPED_CODE }));
    }
    controller.signal.throwIfAborted();
  }

  const timer = setInterval(() => {
    if (pending || controller.signal.aborted) return;
    pending = check().catch((error) => controller.abort(error)).finally(() => { pending = null; });
  }, 1000);

  return {
    signal: controller.signal,
    check,
    async close() {
      clearInterval(timer);
      await pending;
    },
  };
}
