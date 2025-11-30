import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={true}
      richColors
      closeButton
      icons={{
        success: <CircleCheck className="h-5 w-5" />,
        info: <Info className="h-5 w-5" />,
        warning: <TriangleAlert className="h-5 w-5" />,
        error: <OctagonX className="h-5 w-5" />,
        loading: <LoaderCircle className="h-5 w-5 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-900 group-[.toaster]:border group-[.toaster]:border-gray-200 group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:p-4 group-[.toaster]:gap-3",
          description: "group-[.toast]:text-gray-600 group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:bg-blue-600 group-[.toast]:text-white group-[.toast]:rounded-lg group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm group-[.toast]:font-medium hover:group-[.toast]:bg-blue-700",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-700 group-[.toast]:rounded-lg group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm hover:group-[.toast]:bg-gray-200",
          closeButton:
            "group-[.toast]:bg-white group-[.toast]:text-gray-500 group-[.toast]:border group-[.toast]:border-gray-200 hover:group-[.toast]:bg-gray-100 group-[.toast]:rounded-lg group-[.toast]:shadow-sm",
          success: "group-[.toast]:text-green-600 group-[.toast]:border-green-200 group-[.toast]:bg-green-50",
          error: "group-[.toast]:text-red-600 group-[.toast]:border-red-200 group-[.toast]:bg-red-50",
          warning: "group-[.toast]:text-yellow-600 group-[.toast]:border-yellow-200 group-[.toast]:bg-yellow-50",
          info: "group-[.toast]:text-blue-600 group-[.toast]:border-blue-200 group-[.toast]:bg-blue-50",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
