(function () {
  window.Plano3D = window.Plano3D || {};

  const { deepClone } = window.Plano3D.utils;

  class CommandStack {
    constructor(getState, replaceState, onChange) {
      this.getState = getState;
      this.replaceState = replaceState;
      this.onChange = onChange;
      this.undoStack = [];
      this.redoStack = [];
    }

    commit(label, mutate) {
      const before = deepClone(this.getState());
      mutate();
      const after = deepClone(this.getState());
      this.undoStack.push({ label, before, after });
      this.redoStack = [];
      this.onChange?.(label);
    }

    snapshot(label) {
      this.undoStack.push({
        label,
        before: deepClone(this.getState()),
        after: null
      });
      this.redoStack = [];
    }

    closeSnapshot(label) {
      const entry = this.undoStack[this.undoStack.length - 1];
      if (!entry || entry.after) return;
      entry.label = label || entry.label;
      entry.after = deepClone(this.getState());
      this.onChange?.(entry.label);
    }

    cancelOpenSnapshot() {
      const entry = this.undoStack[this.undoStack.length - 1];
      if (entry && !entry.after) this.undoStack.pop();
    }

    undo() {
      const entry = this.undoStack.pop();
      if (!entry) return false;
      if (!entry.after) return false;
      this.redoStack.push(entry);
      this.replaceState(deepClone(entry.before));
      this.onChange?.(`Deshacer ${entry.label}`);
      return true;
    }

    redo() {
      const entry = this.redoStack.pop();
      if (!entry) return false;
      this.undoStack.push(entry);
      this.replaceState(deepClone(entry.after));
      this.onChange?.(`Rehacer ${entry.label}`);
      return true;
    }

    clear() {
      this.undoStack = [];
      this.redoStack = [];
    }
  }

  window.Plano3D.commands = { CommandStack };
}());
