import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowDevices } from '../../components/snow/SnowDevices';
import { useDeviceStore } from '../../store/deviceStore';
import { notify } from '../../components/NotificationProvider';

const Devices: React.FC = () => {
  const navigate = useNavigate();
  const { devices, fetchDevices, addDevice, removeDevice, updateDeviceName } = useDeviceStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionModal, setActionModal] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ key: '', password: '' });

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleDeviceClick = (device: any) => {
    if (!device.is_online) {
      notify('Device is offline', 'warning');
      return;
    }
    navigate(`/session/${device.access_key}`);
  };

  const handleBulkDelete = async (ids: string[]) => {
    for (const id of ids) {
      await removeDevice(id);
    }
    notify(`Successfully removed ${ids.length} devices`, 'success');
  };

  const handleAddDevice = async () => {
    try {
      await addDevice(addForm.key.replace(/\s/g, ''), addForm.password);
      setShowAddModal(false);
      setAddForm({ key: '', password: '' });
      notify('Device linked successfully', 'success');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to link device', 'error');
    }
  };

  return (
    <DashboardLayout title="My Devices">
      <SnowDevices 
        devices={devices} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setSelectedDevice={() => {}} // Not used in this version
        handleDeviceClick={handleDeviceClick}
        setActionModal={setActionModal}
        setShowAddModal={setShowAddModal}
        handleBulkDelete={handleBulkDelete}
      />

      {/* Add Device Modal - SnowUI Style */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] sm:rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
            <h2 className="text-xl font-bold text-[#1C1C1C] mb-2 tracking-tight">Link New Node</h2>
            <p className="text-sm text-[rgba(28,28,28,0.4)] mb-8 font-medium">Enter the 9-digit access key from the remote device.</p>
            
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Access Key</label>
                <input 
                  autoFocus
                  placeholder="123 456 789"
                  value={addForm.key}
                  onChange={e => setAddForm({...addForm, key: e.target.value})}
                  className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3.5 text-sm font-semibold focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Hardware Password (Optional)</label>
                <input 
                  type="password"
                  placeholder="Enter if set on remote device"
                  value={addForm.password}
                  onChange={e => setAddForm({...addForm, password: e.target.value})}
                  className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3.5 text-sm font-semibold focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] bg-white border border-[rgba(28,28,28,0.06)] transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddDevice}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#1C1C1C] shadow-lg shadow-black/10 hover:opacity-90 transition-all"
                >
                  Link Node
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal (Rename/Delete) */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] sm:rounded-[32px] w-full max-w-sm p-6 sm:p-8 shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
            <h2 className="text-xl font-bold text-[#1C1C1C] mb-6 tracking-tight capitalize">{actionModal.type} Node</h2>
            
            {actionModal.type === 'rename' ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">New Node Name</label>
                  <input 
                    defaultValue={actionModal.device.device_name}
                    id="rename-input"
                    className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3.5 text-sm font-semibold focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setActionModal(null)} className="flex-1 py-3 border border-[rgba(28,28,28,0.06)] rounded-xl text-xs font-bold text-[rgba(28,28,28,0.4)]">Cancel</button>
                  <button 
                    onClick={async () => {
                      const newName = (document.getElementById('rename-input') as HTMLInputElement).value;
                      await updateDeviceName(actionModal.device.id, newName);
                      setActionModal(null);
                      notify('Device renamed successfully', 'success');
                    }}
                    className="flex-1 py-3 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold shadow-lg shadow-black/10"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
                <div className="space-y-6">
                   <p className="text-sm text-[rgba(28,28,28,0.4)] font-medium">Are you sure you want to remove this node from your secure mesh network?</p>
                   <div className="flex gap-3">
                    <button onClick={() => setActionModal(null)} className="flex-1 py-3 border border-[rgba(28,28,28,0.06)] rounded-xl text-xs font-bold text-[rgba(28,28,28,0.4)]">Go Back</button>
                    <button 
                      onClick={async () => {
                        await removeDevice(actionModal.device.id);
                        setActionModal(null);
                        notify('Device removed successfully', 'success');
                      }}
                      className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-500/10"
                    >
                      Remove Node
                    </button>
                  </div>
                </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Devices;
