import toast from "react-hot-toast";

export const notificationService = {
  success: (message) => {
    toast.success(message, {
      duration: 4000,
      position: "top-right",
      style: {
        background: "#10B981",
        color: "white",
        fontWeight: "500",
        padding: "16px",
        borderRadius: "8px",
      },
    });
  },

  error: (message) => {
    toast.error(message, {
      duration: 5000,
      position: "top-right",
      style: {
        background: "#EF4444",
        color: "white",
        fontWeight: "500",
        padding: "16px",
        borderRadius: "8px",
      },
    });
  },

  warning: (message) => {
    toast(message, {
      duration: 4000,
      position: "top-right",
      style: {
        background: "#F59E0B",
        color: "white",
        fontWeight: "500",
        padding: "16px",
        borderRadius: "8px",
      },
    });
  },

  info: (message) => {
    toast(message, {
      duration: 3000,
      position: "top-right",
      style: {
        background: "#3B82F6",
        color: "white",
        fontWeight: "500",
        padding: "16px",
        borderRadius: "8px",
      },
    });
  },
};
