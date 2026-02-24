import React, { useCallback, useEffect } from "react";

const HomePage = () => {

  /* =========================
     FETCH DATA 1
  ========================== */

  const fetchData1 = useCallback(async () => {
    try {
      const response = await fetch("api/endpoint1");
      const data = await response.json();

      // process data
      console.log("Endpoint 1:", data);

    } catch (error) {
      console.error("Failed to fetch endpoint1", error);
    }
  }, []);

  /* =========================
     FETCH DATA 2
  ========================== */

  const fetchData2 = useCallback(async () => {
    try {
      const response = await fetch("api/endpoint2");
      const data = await response.json();

      // process data
      console.log("Endpoint 2:", data);

    } catch (error) {
      console.error("Failed to fetch endpoint2", error);
    }
  }, []);

  /* =========================
     USE EFFECT CALL
  ========================== */

  useEffect(() => {
    fetchData1();
    fetchData2();
  }, [fetchData1, fetchData2]);

  /* =========================
     UI
  ========================== */

  return (
    <div>
      <h1>Home Page</h1>
      {/* Your page content here */}
    </div>
  );
};

export default HomePage;
