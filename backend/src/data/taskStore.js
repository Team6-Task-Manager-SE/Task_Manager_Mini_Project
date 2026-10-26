function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let tasks = [
  {
    id: 1,
    title: "Finish SE mini project",
    description: "Complete Sprint 1 implementation",
    dueDate: null,
    status: "todo",
    ownerId: null,
  },
  {
    id: 2,
    title: "Record sprint 1 demo video",
    description: "",
    dueDate: null,
    status: "todo",
    ownerId: null,
  },
  {
    id: 3,
    title: "Review pull requests",
    description: "",
    dueDate: null,
    status: "in-progress",
    ownerId: null,
  },
];

let nextId = 4;

function getAll(ownerId) {
  return tasks.filter(
    (task) => task.ownerId === Number(ownerId)
  );
}

function getById(id) {
  return tasks.find((task) => task.id === id) || null;
}

function create({ title, description = "", dueDate = null, ownerId }) {
  const task = {
    id: nextId++,
    title: escapeHtml(title),
    description: escapeHtml(description),
    dueDate,
    status: "todo",
    ownerId: Number(ownerId),
  };

  tasks.push(task);
  return task;
}

function update(id, ownerId, changes) {
  const task = tasks.find(
    (task) =>
      task.id === id &&
      task.ownerId === Number(ownerId)
  );

  if (!task) {
    return null;
  }

  if (changes.title !== undefined) {
    task.title = escapeHtml(changes.title);
  }

  if (changes.description !== undefined) {
    task.description = escapeHtml(changes.description);
  }

  if (changes.dueDate !== undefined) {
    task.dueDate = changes.dueDate;
  }

  return task;
}

function remove(id, ownerId) {
  const index = tasks.findIndex(
    (task) =>
      task.id === id &&
      task.ownerId === Number(ownerId)
  );

  if (index === -1) {
    return false;
  }

  tasks.splice(index, 1);
  return true;
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};