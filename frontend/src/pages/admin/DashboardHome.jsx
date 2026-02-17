import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, Image, MessageSquare, Mail, TrendingUp, Clock } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardHome = () => {
  const [stats, setStats] = useState({
    total_bookings: 0,
    pending_bookings: 0,
    confirmed_bookings: 0,
    portfolio_count: 0,
    testimonials_count: 0,
    unread_messages: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/admin/bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setStats(statsRes.data);
      setRecentBookings(bookingsRes.data.slice(0, 5));
    } catch (e) {
      console.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      icon: Calendar,
      label: "Total Bookings",
      value: stats.total_bookings,
      color: "bg-blue-500",
      link: "/admin/bookings",
    },
    {
      icon: Clock,
      label: "Pending",
      value: stats.pending_bookings,
      color: "bg-yellow-500",
      link: "/admin/bookings",
    },
    {
      icon: Image,
      label: "Portfolio Items",
      value: stats.portfolio_count,
      color: "bg-purple-500",
      link: "/admin/portfolio",
    },
    {
      icon: MessageSquare,
      label: "Testimonials",
      value: stats.testimonials_count,
      color: "bg-green-500",
      link: "/admin/testimonials",
    },
    {
      icon: Mail,
      label: "Unread Messages",
      value: stats.unread_messages,
      color: "bg-red-500",
      link: "/admin/messages",
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-home">
      <h1 className="font-display text-2xl md:text-3xl font-semibold mb-8">
        Welcome Back!
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
        {statCards.map((stat, index) => (
          <Link
            key={index}
            to={stat.link}
            className="bg-white rounded-xl p-6 shadow-soft hover:shadow-md transition-shadow"
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold">Recent Bookings</h2>
          <Link
            to="/admin/bookings"
            className="text-primary text-sm hover:underline"
          >
            View All
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No bookings yet. They'll appear here once clients start booking.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="recent-bookings-table">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                    Client
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                    Session
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="border-b last:border-0">
                    <td className="py-4 px-4">
                      <p className="font-medium">{booking.client_name}</p>
                      <p className="text-sm text-muted-foreground">{booking.client_email}</p>
                    </td>
                    <td className="py-4 px-4 capitalize">{booking.session_type}</td>
                    <td className="py-4 px-4">
                      <p>{booking.booking_date}</p>
                      <p className="text-sm text-muted-foreground">{booking.booking_time}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;
