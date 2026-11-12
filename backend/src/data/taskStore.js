function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PRIORITIES = ["low", "medium", "high"];

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen = new Set();

  tags.forEach((tag) => {
    const clean = String(tag).trim().toLowerCase();
    if (clean) {
      seen.add(escapeHtml(clean));
    }
  });

  return Array.from(seen);
}

let tasks = [
  {
    id: 1,
    title: "Finish SE mini project",
    description: "Complete Sprint 1 implementation",
    dueDate: null,
    status: "todo",
    priority: "medium",
    tags: [],
    category: "",
    ownerId: null,
  },
  {
    id: 2,
    title: "Record sprint 1 demo video",
    description: "",
    dueDate: null,
    status: "todo",
    priority: "medium",
    tags: [],
    category: "",
    ownerId: null,
  },
  {
    id: 3,
    title: "Review pull requests",
    description: "",
    dueDate: null,
    status: "in-progress",
    priority: "medium",
    tags: [],
    category: "",
    ownerId: null,
  },
];

let nextId = 4;

function getAll(ownerId) {
  return tasks.filter(
    (task) => task.ownerId === Number(ownerId)
  );
}

function getSummary(ownerId) {
  const own = getAll(ownerId);
  const now = Date.now();
  const byStatus = { todo: 0, "in-progress": 0, completed: 0 };
  const byPriority = { low: 0, medium: 0, high: 0 };
  let overdue = 0;

  own.forEach((task) => {
    byStatus[task.status] += 1;
    byPriority[task.priority] += 1;
    if (
      task.status !== "completed" &&
      task.dueDate &&
      new Date(task.dueDate).getTime() < now
    ) {
      overdue += 1;
    }
  });

  return {
    total: own.length,
    byStatus,
    byPriority,
    overdue,
    completionRate: own.length
      ? Math.round((byStatus.completed / own.length) * 100)
      : 0,
  };
}

function getById(id) {
  return tasks.find((task) => task.id === id) || null;
}

function create({
  title,
  description = "",
  dueDate = null,
  priority = "medium",
  tags = [],
  category = "",
  ownerId,
}) {
  const task = {
    id: nextId++,
    title: escapeHtml(title),
    description: escapeHtml(description),
    dueDate,
    status: "todo",
    priority: PRIORITIES.includes(priority) ? priority : "medium",
    tags: normalizeTags(tags),
    category: escapeHtml(String(category).trim()),
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

  if (changes.status !== undefined) {
    task.status = changes.status;
  }

  if (changes.priority !== undefined) {
    task.priority = changes.priority;
  }

  if (changes.tags !== undefined) {
    task.tags = normalizeTags(changes.tags);
  }

  if (changes.category !== undefined) {
    task.category = escapeHtml(String(changes.category).trim());
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
  getSummary,
  getById,
  create,
  update,
  remove,
};