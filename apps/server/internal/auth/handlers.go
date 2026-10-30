package auth

import (
	"encoding/json"
	"net/http"

	"gumbound-web/server/internal/gateway"
	"gumbound-web/server/internal/protocol"
)

type RegisterRequest struct {
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token,omitempty"`
	User  *User  `json:"user,omitempty"`
	Error string `json:"error,omitempty"`
}

type Handlers struct {
	service *AuthService
}

func NewHandlers(service *AuthService) *Handlers {
	return &Handlers{service: service}
}

func (h *Handlers) HandleRegister(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(AuthResponse{Error: "invalid request body"})
		return
	}

	user, err := h.service.Register(req.Username, req.Nickname, req.Email, req.Password)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(AuthResponse{Error: err.Error()})
		return
	}

	token, _ := h.service.Login(req.Username, req.Password)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{Token: token, User: user})
}

func (h *Handlers) HandleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(AuthResponse{Error: "invalid request body"})
		return
	}

	token, err := h.service.Login(req.Username, req.Password)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(AuthResponse{Error: "invalid username or password"})
		return
	}

	user, _ := h.service.repo.FindByUsername(req.Username)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(AuthResponse{Token: token, User: user})
}

// RegisterWebSocketHandler connects auth verification over the WebSocket gateway
func (h *Handlers) RegisterWebSocketHandler(gw *gateway.Gateway) {
	gw.RegisterHandler(protocol.OpcodeAuthRequest, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			Token string `json:"token"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			c.Send(protocol.Message{
				Opcode:  protocol.OpcodeAuthResponse,
				Payload: []byte(`{"error":"invalid_json"}`),
			})
			return
		}

		claims, err := h.service.ValidateToken(req.Token)
		if err != nil {
			c.Send(protocol.Message{
				Opcode:  protocol.OpcodeAuthResponse,
				Payload: []byte(`{"error":"unauthorized"}`),
			})
			return
		}

		c.UserID = claims.UserID
		c.Username = claims.Username

		resp, _ := json.Marshal(map[string]interface{}{
			"status":   "authenticated",
			"user_id":  claims.UserID,
			"username": claims.Username,
		})

		c.Send(protocol.Message{
			Opcode:  protocol.OpcodeAuthResponse,
			Payload: resp,
		})
	})
}
