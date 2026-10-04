export function watchVisibility(element: Element | null, set: (visible: boolean) => void): () => void {
  let inView = true;
  const update = () => set(inView && document.visibilityState === "visible");
  const observer = new IntersectionObserver((entries) => {
    inView = entries.at(-1)?.isIntersecting ?? inView;
    update();
  });
  if (element) observer.observe(element);
  document.addEventListener("visibilitychange", update);
  update();
  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", update);
  };
}
