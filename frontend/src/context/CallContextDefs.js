import { createContext, useContext } from "react";

export const CallContext = createContext();

export const useCall = () => {
    return useContext(CallContext);
};
