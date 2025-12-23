import React from "react";
import DynamicFormSystem from "./components/DynamicFormSystem";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <div className="App">
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        containerClassName=""
        containerStyle={{}}
        toastOptions={{
          className: "",
          duration: 4000,
        }}
      />
      <DynamicFormSystem />
    </div>
  );
}

export default App;
