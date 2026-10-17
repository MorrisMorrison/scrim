// "Last one wins" for overlapping async work. Each call starts a run and returns a check
// that stays true only until the next run starts, so a run that resumes after an await
// can tell it has been superseded and must not touch the page.
export function latestRun(): () => () => boolean {
  let seq = 0;
  return () => {
    const mine = ++seq;
    return () => mine === seq;
  };
}
