function SuccessMessage({ children }) {
  if (!children) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
      {children}
    </div>
  );
}

export default SuccessMessage;
