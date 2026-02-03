import { create } from 'zustand';


interface PhotoviewStore {
    view: "Gallery" | "List"
    setView: (newView: "Gallery" | "List") => void
}
export const usePhotoviewStore = create<PhotoviewStore>()(

    (set) => ({
        view: 'Gallery',
        setView: async (newView: "Gallery" | "List") => {
            set({ view: newView })
        },

    })

);

const setView = async (newView: "Gallery" | "List") => {

}

