window.ProcessStatusEnum = {
  0: {
    value: 0,
    label: "Rascunho",
    cssClass: "label-default",
  },
  1: {
    value: 1,
    label: "Em andamento",
    cssClass: "label-primary",
  },
  2: {
    value: 2,
    label: "Próximo do prazo",
    cssClass: "label-success",
  },
  3: {
    value: 3,
    label: "Atrasado",
    cssClass: "label-danger",
  },
  4: {
    value: 4,
    label: "Finalizado",
    cssClass: "label-success",
  },

  // helpers
  getLabel(value) {
    return this[value]?.label ?? `Status ${value}`;
  },

  getCssClass(value) {
    return this[value]?.cssClass ?? "label-default";
  },

  toSelectOptions() {
    return Object.values(this)
      .filter(v => typeof v === "object")
      .map(v => ({
        value: v.value,
        label: v.label,
      }));
  },
};