import { useCall } from "../../context/CallContextDefs";
import CallModal from "./CallModal";
import GroupCallModal from "./GroupCallModal";

export default function GlobalCallUI() {
    const { isCallModalOpen, activeCall, incomingCall, rejectCall, endCall, peer, myPeerId } = useCall();

    if (!isCallModalOpen) return null;

    // Group Call
    if (activeCall?.type === 'group') {
        return <GroupCallModal groupId={activeCall.id} onClose={endCall} />;
    }

    // P2P Call (Incoming or Outgoing)
    // NOTE: For outgoing, 'incomingCall' is null, call is in 'activeCall.callObject' (if established) or pending.
    // CallModal handles its own creation of outgoing calls if passed 'remoteUserId' and no 'call' object initially.

    const callProps = {
        peer,
        isIncoming: !!incomingCall,
        call: incomingCall?.callObject || activeCall?.callObject,
        remoteUserId: incomingCall?.from || activeCall?.id,
        onClose: incomingCall ? rejectCall : endCall,
        // New Prop for Random ID Dialing
        targetPeerId: activeCall?.targetPeerId,
        // New Prop for Call State (Dialing/Ringing)
        callState: activeCall?.callState,
        // Default to video unless specified
        isVideoCall: incomingCall?.callType ? incomingCall.callType === 'video' : (activeCall?.isVideo ?? true)
    };

    return <CallModal {...callProps} />;
}
