export function SearchForm({
  defaults = {},
}: {
  defaults?: Record<string, string>;
}) {
  return (
    <form action="/search" className="search-bar">
      <label>
        <span>⌖ &nbsp; WHERE ARE YOU?</span>
        <input
          name="city"
          placeholder="Enter your city"
          defaultValue={defaults.city}
          autoComplete="address-level2"
          maxLength={100}
        />
      </label>
      <label>
        <span>▤ &nbsp; YOUR CLASS</span>
        <select name="classLevel" defaultValue={defaults.classLevel || ""}>
          <option value="">All classes</option>
          {[8, 9, 10, 11, 12].map((n) => (
            <option key={n} value={n}>
              Class {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>✎ &nbsp; YOUR SUBJECT</span>
        <input
          name="subject"
          placeholder="What do you want to learn?"
          defaultValue={defaults.subject}
          maxLength={100}
        />
      </label>
      <button className="button dark-button" type="submit">
        Find my tuition <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
