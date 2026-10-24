let tasks = [
  {
    id: 1,
    title: "Finish SE mini project",
    description: "Complete Sprint 1 implementation",
    dueDate: null,
    status: "todo",
  },
  {
    id: 2,
    title: "Record sprint 1 demo video",
    description: "",
    dueDate: null,
    status: "todo",
  },
  {
    id: 3,
    title: "Review pull requests",
    description: "",
    dueDate: null,
    status: "in-progress",
  },
];

let nextId = 4;

function getAll() {
  return tasks;
}

function create({ title, description = "", dueDate = null }) {
  const task = {
    id: nextId++,
    title,
    description,
    dueDate,
    status: "todo",
  };

  tasks.push(task);
  return task;
}

function remove(id) {
  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    return false;
  }

  tasks.splice(index, 1);
  return true;
}

module.exports = {
  getAll,
  create,
  remove,
};
