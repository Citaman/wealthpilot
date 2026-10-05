// Persisted icon identifiers: safe to use in data validation without loading SVG/React.
export const goalIconKeys =
  "target house phone car travel safety education child computer heart armchair bath bed building cooking door hammer key lamp sofa bike bus caravan compass fuel luggage map mountain boat train book work camera coffee sport games gift guitar headphones music monitor printer tablet tv watch wifi wrench art pencil shopping cat dog flower leaf pet garden health camping umbrella family wallet piggy bank money gem star trophy sparkles cake food none".split(
    " ",
  );
export const isGoalIconKey = (value: string) => goalIconKeys.includes(value);
