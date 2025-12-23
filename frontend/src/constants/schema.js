export const DEFAULT_SCHEMA = {
  record: {
    users: {
      route: "/api/users",
      backend: {
        schema: {
          id: { type: "Number", unique: true, index: true, sparse: true },
          name: { type: "String", required: true, trim: true },
          email: {
            type: "String",
            required: true,
            unique: true,
            lowercase: true,
          },
          phone: { type: "String", required: true },
        },
        options: { timestamps: true, strict: false },
      },
      frontend: {
        apiPath: "/users",
        fields: [
          { name: "name", label: "Name", required: true, type: "text" },
          { name: "email", label: "Email", required: true, type: "email" },
          { name: "phone", label: "Phone", required: true, type: "text" },
        ],
        columns: [
          { header: "ID", accessor: "id" },
          { header: "Name", accessor: "name" },
          { header: "Email", accessor: "email" },
          { header: "Phone", accessor: "phone" },
        ],
      },
    },
  },
};
