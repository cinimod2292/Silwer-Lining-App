import React, { useState, useEffect, useCallback } from 'react';

const CompleteBookingPage = () => {
    const [bookingData, setBookingData] = useState(null);

    const fetchBookingData = useCallback(async () => {
        // Fetch booking data logic here
    }, []);

    useEffect(() => {
        fetchBookingData();
    }, [fetchBookingData]); // added fetchBookingData to deps

    return (
        <div>
            {/* Your component JSX here */}
        </div>
    );
};

export default CompleteBookingPage;