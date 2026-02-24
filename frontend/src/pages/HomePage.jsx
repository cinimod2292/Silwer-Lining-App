import React, { useCallback } from 'react';

const HomePage = () => {

  const fetchData1 = useCallback(async () => {
    const response = await fetch('api/endpoint1');
    const data = await response.json();
    // process data
  }, []);

  const fetchData2 = useCallback(async () => {
    const response = await fetch('api/endpoint2');
    const data = await response.json();
    // process data
  }, []);

  // Call fetch functions as needed

  return (
    <div>
      <h1>Home Page</h1>
      {/* Your page content here */}
    </div>
  );
};

export default HomePage;