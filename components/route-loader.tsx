import { Spinner } from "./loader";

export function RouteLoader() {
  return (
    <div className="route-load" role="status" aria-label="Loading page">
      <Spinner size={80} />
      <b>
        job atlas<span>.</span>
      </b>
    </div>
  );
}
