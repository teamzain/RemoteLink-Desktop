import React from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowMembers } from '../../components/snow/SnowMembers';
import { useAuthStore } from '../../store/authStore';

const Members: React.FC = () => {
    const { user } = useAuthStore();

    return (
        <DashboardLayout title="Team Management">
            <div className="w-full animate-in fade-in duration-700">
                <SnowMembers user={user} />
            </div>
        </DashboardLayout>
    );
};

export default Members;
