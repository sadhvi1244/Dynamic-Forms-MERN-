export default {
  record: {
    customers: {
      route: "/api/customers",
      backend: {
        schema: {
          id: {
            type: "Number",
            unique: true,
            index: true,
          },
          name: {
            type: "String",
            required: true,
            trim: true,
          },
          email: {
            type: "String",
            required: true,
            unique: true,
          },
          phone: {
            type: "String",
          },
          address: {
            type: "String",
          },
        },
        options: {
          timestamps: true,
          strict: false,
        },
      },
      frontend: {
        apiPath: "/customers",
        fields: [
          {
            name: "name",
            label: "Customer Name",
            required: true,
            type: "text",
          },
          {
            name: "email",
            label: "Email",
            required: true,
            type: "email",
          },
          {
            name: "phone",
            label: "Phone",
            required: false,
            type: "text",
          },
          {
            name: "address",
            label: "Address",
            required: false,
            type: "textarea",
          },
        ],
        columns: [
          { header: "ID", accessor: "id" },
          { header: "Name", accessor: "name" },
          { header: "Email", accessor: "email" },
          { header: "Phone", accessor: "phone" },
          { header: "Address", accessor: "address" },
        ],
      },
    },
    inventory: {
      route: "/api/inventory",
      backend: {
        schema: {
          id: {
            type: "Number",
            unique: true,
          },
          productName: {
            type: "String",
            required: true,
          },
          sku: {
            type: "String",
            unique: true,
          },
          quantity: {
            type: "Number",
            required: true,
          },
          warehouseLocation: {
            type: "String",
          },
        },
        options: {
          timestamps: true,
        },
      },
      frontend: {
        apiPath: "/inventory",
        fields: [
          {
            name: "productName",
            label: "Product Name",
            required: true,
            type: "text",
          },
          {
            name: "quantity",
            label: "Quantity",
            required: true,
            type: "number",
          },
          {
            name: "warehouseLocation",
            label: "Warehouse Location",
            required: false,
            type: "text",
          },
        ],
        columns: [
          { header: "ID", accessor: "id" },
          { header: "Product Name", accessor: "productName" },
          { header: "Quantity", accessor: "quantity" },
          { header: "Warehouse Location", accessor: "warehouseLocation" },
        ],
      },
    },
    transactions: {
      route: "/api/transactions",
      backend: {
        schema: {
          transactionId: {
            type: "String",
            unique: true,
          },
          customerId: {
            type: "Number",
            required: true,
          },
          productIds: {
            type: "Array",
          },
          totalAmount: {
            type: "Number",
            required: true,
          },
          paymentMethod: {
            type: "String",
            required: true,
          },
          transactionDate: {
            type: "Date",
            default: "Date.now",
          },
        },
        options: {
          timestamps: true,
        },
      },
      frontend: {
        apiPath: "/transactions",
        fields: [
          {
            name: "customerId",
            label: "Customer ID",
            required: true,
            type: "number",
          },
          {
            name: "productIds",
            label: "Product IDs",
            required: true,
            type: "text",
          },
          {
            name: "totalAmount",
            label: "Total Amount",
            required: true,
            type: "number",
          },
          {
            name: "paymentMethod",
            label: "Payment Method",
            required: true,
            type: "dropdown",
            options: ["Credit Card", "UPI", "Cash"],
          },
          {
            name: "transactionDate",
            label: "Transaction Date",
            required: false,
            type: "date",
          },
        ],
        columns: [
          { header: "Transaction ID", accessor: "transactionId" },
          { header: "Customer ID", accessor: "customerId" },
          { header: "Product IDs", accessor: "productIds" },
          { header: "Total Amount", accessor: "totalAmount" },
          { header: "Payment Method", accessor: "paymentMethod" },
          { header: "Transaction Date", accessor: "transactionDate" },
        ],
      },
    },
  },
};
