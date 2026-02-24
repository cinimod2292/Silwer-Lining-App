import React, { useCallback } from 'react';

const CompleteBookingPage = () => {
    const fetchBookingData = useCallback(async () => {
        try {
            const response = await fetch('/api/booking');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            console.log(data);
        } catch (error) {
            console.error('There has been a problem with your fetch operation:', error);
        }
    }, []);

    // Call fetchBookingData whenever needed

    return (
        <div>
            <h1>Complete Booking</h1>
            {/* More UI components */}
        </div>
    );
};

export default CompleteBookingPage;