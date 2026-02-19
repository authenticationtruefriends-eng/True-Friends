import { useState } from 'react';
import { X, UserPlus, LogOut, Trash2, User, Shield } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import ConfirmModal from '../common/ConfirmModal';

export default function GroupInfo({ group, onClose, currentUserId }) {
    const { socket } = useSocket();
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const isAdmin = group?.createdBy === currentUserId;

    if (!group) return null;

    const handleLeaveGroup = () => {
        setConfirmLeave(true);
    };

    const handleDeleteGroup = () => {
        setConfirmDelete(true);
    };

    const handleAddMember = () => {
        const newMemberId = prompt("Enter User ID to add (e.g. john_doe):");
        if (newMemberId) {
            socket.emit("add-group-member", { groupId: group.id, memberId: newMemberId.toLowerCase(), by: currentUserId });
        }
    };

    return (
        <div className="group-info-overlay">
            <div className="group-info-container">
                <div className="group-info-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, fontWeight: '800', color: 'var(--primary)', fontSize: '1.2rem' }}>Group Info</h3>
                    <button onClick={onClose} className="icon-btn" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><X size={20} /></button>
                </div>

                <div className="group-profile" style={{ padding: '2.5rem 1.5rem', background: 'var(--primary-soft)' }}>
                    <div className="group-avatar-large" style={{
                        width: '90px', height: '90px', borderRadius: '24px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                        fontSize: '2rem', fontWeight: '800', boxShadow: 'var(--shadow-lg)',
                        marginBottom: '1rem', border: '3px solid white'
                    }}>
                        {group.name.substring(0, 2).toUpperCase()}
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 5px' }}>{group.name}</h2>
                    <p className="group-meta" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '500' }}>
                        Managed by <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{group.createdBy === currentUserId ? 'You' : group.createdBy}</span>
                    </p>
                </div>

                <div className="group-members-section" style={{ padding: '1.5rem' }}>
                    <div className="section-header" style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Members • {group.members.length}
                        </h4>
                        <button className="icon-btn" onClick={handleAddMember} title="Add Member" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            <UserPlus size={20} />
                        </button>
                    </div>

                    <div className="members-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.members.map(memberId => (
                            <div key={memberId} className="member-item" style={{
                                padding: '10px 12px', borderRadius: '14px', background: 'var(--bg-color)',
                                border: '1px solid var(--border-color)', transition: 'transform 0.2s'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(5px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                            >
                                <div className="member-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="member-avatar" style={{
                                        width: '36px', height: '36px', borderRadius: '10px',
                                        background: memberId === group.createdBy ? 'var(--primary)' : 'white',
                                        color: memberId === group.createdBy ? 'white' : 'var(--text-secondary)',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <User size={18} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                            {memberId === currentUserId ? "You" : memberId}
                                        </div>
                                        {group.createdBy === memberId && (
                                            <div style={{
                                                fontSize: '0.65rem', color: 'var(--accent)', fontWeight: '800',
                                                textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px',
                                                display: 'flex', alignItems: 'center', gap: '3px'
                                            }}>
                                                <Shield size={10} fill="var(--accent)" /> ADMIN
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="group-actions" style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                    <button className="logout-btn" onClick={handleLeaveGroup} style={{ width: '100%', borderRadius: '14px', marginBottom: '8px' }}>
                        <LogOut size={20} />
                        Leave Group
                    </button>

                    {isAdmin && (
                        <button className="logout-btn" onClick={handleDeleteGroup} style={{ width: '100%', borderRadius: '14px', color: '#ef4444', borderColor: '#fee2e2' }}>
                            <Trash2 size={20} />
                            Delete Group
                        </button>
                    )}
                </div>

                <ConfirmModal
                    isOpen={confirmLeave}
                    onClose={() => setConfirmLeave(false)}
                    onConfirm={() => {
                        socket.emit("leave-group", { groupId: group.id, userId: currentUserId });
                        onClose();
                    }}
                    title="Leave Group?"
                    message="Are you sure you want to leave this group? You will no longer receive messages from this conversation."
                    confirmText="Leave Group"
                    type="warning"
                />

                <ConfirmModal
                    isOpen={confirmDelete}
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={() => {
                        socket.emit("delete-group", { groupId: group.id, userId: currentUserId });
                        onClose();
                    }}
                    title="Delete Group?"
                    message="Are you sure you want to DELETE this group? This will remove the group and all messages for every member. This action is irreversible."
                    confirmText="Delete Group"
                    type="danger"
                />
            </div>
        </div>
    );
}
