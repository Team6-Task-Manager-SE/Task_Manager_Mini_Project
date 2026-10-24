let tasks = [
  { id: 1, title: "Finish SE mini project", status: "todo" },
  { id: 2, title: "Record sprint 1 demo video", status: "todo" },
  { id: 3, title: "Review pull requests", status: "in-progress" },
];
let nextId = 4;

function getAll() {
  return tasks;
}

function create(title) {
  const task = { id: nextId++, title, status: "todo" };
  tasks.push(task);
  return task;
}

function remove(id) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  tasks.splice(index, 1);
  return true;
}

module.exports = { getAll, create, remove };
